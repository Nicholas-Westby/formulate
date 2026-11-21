using System.Net;
using Formulate.Extensions.PlainJavaScriptTemplate.Controllers;
using Formulate.Web.Utilities;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;

namespace Formulate.Extensions.PlainJavaScriptTemplate.Tests;

/// <summary>
/// Posts to the submission endpoint through ASP.NET Core's real routing, model binding and
/// [ApiController] validation, hosted in memory.
/// </summary>
public sealed class SubmissionControllerTests
{
    private static readonly string FormId = Guid.NewGuid().ToString("N");

    [Fact]
    public async Task Submission_without_a_page_id_is_accepted()
    {
        await using var site = await SubmissionSite.StartAsync();

        var response = await site.PostAsync(("FormId", FormId));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Null(site.Submitted!.PageId);
    }

    [Fact]
    public async Task Submission_with_an_empty_page_id_is_accepted()
    {
        await using var site = await SubmissionSite.StartAsync();

        var response = await site.PostAsync(("FormId", FormId), ("PageId", ""));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Null(site.Submitted!.PageId);
    }

    [Fact]
    public async Task Submission_from_a_content_page_passes_its_id_on()
    {
        await using var site = await SubmissionSite.StartAsync();

        var response = await site.PostAsync(("FormId", FormId), ("PageId", "1234"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1234, site.Submitted!.PageId);
    }

    private sealed class SubmissionSite : IAsyncDisposable, IAttemptSubmitForm
    {
        private WebApplication _app = null!;

        public AttemptSubmitFormInput? Submitted { get; private set; }

        public static async Task<SubmissionSite> StartAsync()
        {
            var site = new SubmissionSite();
            var builder = WebApplication.CreateBuilder();
            builder.WebHost.UseTestServer();
            builder.Logging.ClearProviders();
            builder.Services.AddControllersWithViews().AddApplicationPart(typeof(SubmissionController).Assembly);

            // A real token pair needs a rendered page first; these tests are about binding.
            builder.Services.AddSingleton<IAntiforgery, AcceptingAntiforgery>();
            builder.Services.AddSingleton<IAttemptSubmitForm>(site);

            site._app = builder.Build();
            site._app.MapControllers();
            await site._app.StartAsync();

            return site;
        }

        public Task<HttpResponseMessage> PostAsync(params (string Key, string Value)[] fields)
        {
            var content = new FormUrlEncodedContent(fields.Select(x => new KeyValuePair<string, string>(x.Key, x.Value)));

            return _app.GetTestClient().PostAsync("/api/formulate/plain-js/submit", content);
        }

        public Task<AttemptSubmitFormOutput> SubmitAsync(AttemptSubmitFormInput input, CancellationToken cancellationToken)
        {
            Submitted = input;

            return Task.FromResult(new AttemptSubmitFormOutput { IsSuccessful = true });
        }

        public async ValueTask DisposeAsync()
        {
            await _app.DisposeAsync();
        }
    }

    private sealed class AcceptingAntiforgery : IAntiforgery
    {
        public AntiforgeryTokenSet GetAndStoreTokens(HttpContext httpContext) => throw new NotSupportedException();

        public AntiforgeryTokenSet GetTokens(HttpContext httpContext) => throw new NotSupportedException();

        public Task<bool> IsRequestValidAsync(HttpContext httpContext) => Task.FromResult(true);

        public void SetCookieTokenAndHeader(HttpContext httpContext)
        {
        }

        public Task ValidateRequestAsync(HttpContext httpContext) => Task.CompletedTask;
    }
}
