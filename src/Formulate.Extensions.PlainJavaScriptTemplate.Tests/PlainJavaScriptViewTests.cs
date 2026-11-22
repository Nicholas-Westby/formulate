using Formulate.Core.Layouts;
using Formulate.Core.RenderModels;
using Formulate.Extensions.PlainJavaScriptTemplate.Core;
using Formulate.Web.RenderModels;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Mvc.Razor;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.Mvc.ViewFeatures;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace Formulate.Extensions.PlainJavaScriptTemplate.Tests;

/// <summary>
/// Renders the form view (Views/Shared/Components/FormulateForm/Plain JavaScript.cshtml), compiled into the
/// template's assembly, on a page with one form or more, and checks the tags it writes.
/// </summary>
public sealed class PlainJavaScriptViewTests
{
    private const string ViewPath = "/Views/Shared/Components/FormulateForm/Plain JavaScript.cshtml";

    [Fact]
    public async Task View_loads_the_renderer_as_a_module()
    {
        var html = await RenderPageAsync(forms: 1, new PlainJavaScriptOptions());

        Assert.Contains("<script type=\"module\" src=\"/site/App_Plugins/Formulate/PlainJavaScript/formulate.min.js", html);
        Assert.DoesNotContain(" defer", html);
    }

    [Fact]
    public async Task View_adds_the_renderer_once_however_many_forms_the_page_has()
    {
        var html = await RenderPageAsync(forms: 2, new PlainJavaScriptOptions { Theme = "basic" });

        Assert.Equal(2, Count(html, "window[key].push(formData);"));
        Assert.Equal(1, Count(html, "<script type=\"module\""));
        Assert.Equal(1, Count(html, "<link rel=\"stylesheet\""));
    }

    private static int Count(string text, string value)
    {
        var count = 0;
        for (var index = text.IndexOf(value, StringComparison.Ordinal); index >= 0; index = text.IndexOf(value, index + value.Length, StringComparison.Ordinal))
        {
            count++;
        }

        return count;
    }

    /// <summary>Renders the view once for each form on a page of a site under the path base /site.</summary>
    private static async Task<string> RenderPageAsync(int forms, PlainJavaScriptOptions options)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Logging.ClearProviders();
        builder.Services.AddControllersWithViews().AddApplicationPart(typeof(PlainJavaScriptAssets).Assembly);
        builder.Services.AddSingleton(Mock.Of<IBuildPlainJavaScriptJson>(x => x.Build(It.IsAny<FormLayoutRenderModel>(), It.IsAny<string>()) == "{}"));
        builder.Services.AddSingleton<IPlainJavaScriptAssets>(new PlainJavaScriptAssets(
            Options.Create(options),
            Mock.Of<ILogger<PlainJavaScriptAssets>>()));

        await using var app = builder.Build();
        app.UsePathBase("/site");
        app.MapGet("/page", (HttpContext context) => RenderFormsAsync(context, forms));
        await app.StartAsync();

        using var client = app.GetTestClient();
        return await client.GetStringAsync("/site/page");
    }

    // A request delegate: it writes the page itself.
    private static async Task RenderFormsAsync(HttpContext context, int forms)
    {
        var services = context.RequestServices;
        var view = services.GetRequiredService<IRazorViewEngine>().GetView(executingFilePath: null, ViewPath, isMainPage: false);
        Assert.True(view.Success, "The view was not found.");

        var actionContext = new ActionContext(context, context.GetRouteData(), new ActionDescriptor());
        var tempData = new TempDataDictionary(context, services.GetRequiredService<ITempDataProvider>());
        using var writer = new StringWriter();

        for (var i = 0; i < forms; i++)
        {
            var model = new FormLayoutRenderModel(new FormRenderModel(Guid.NewGuid(), "Contact " + i, "contact" + i), Mock.Of<ILayout>());
            var viewData = new ViewDataDictionary<FormLayoutRenderModel>(new EmptyModelMetadataProvider(), new ModelStateDictionary()) { Model = model };
            var viewContext = new ViewContext(actionContext, view.View, viewData, tempData, writer, new HtmlHelperOptions());
            await view.View.RenderAsync(viewContext);
        }

        context.Response.ContentType = "text/html";
        await context.Response.WriteAsync(writer.ToString());
    }
}
