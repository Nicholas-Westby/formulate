namespace Formulate.Extensions.SendEmail.DesignedEmail
{
    using Microsoft.AspNetCore.Http;
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.AspNetCore.Mvc.Abstractions;
    using Microsoft.AspNetCore.Mvc.ModelBinding;
    using Microsoft.AspNetCore.Mvc.Razor;
    using Microsoft.AspNetCore.Mvc.Rendering;
    using Microsoft.AspNetCore.Mvc.ViewEngines;
    using Microsoft.AspNetCore.Mvc.ViewFeatures;
    using Microsoft.AspNetCore.Routing;

    /// <summary>
    /// Renders a designed email's Razor views to text with ASP.NET Core's view engine.
    /// </summary>
    internal sealed class RazorEmailViewRenderer
    {
        private readonly IRazorViewEngine _viewEngine;

        private readonly ITempDataProvider _tempDataProvider;

        private readonly IServiceProvider _services;

        public RazorEmailViewRenderer(IRazorViewEngine viewEngine, ITempDataProvider tempDataProvider, IServiceProvider services)
        {
            _viewEngine = viewEngine;
            _tempDataProvider = tempDataProvider;

            // The scope's services, so views can inject scoped services.
            _services = services;
        }

        /// <summary>
        /// Finds the view at an app relative path, such as "~/Views/Emails/Contact.cshtml". Null when
        /// there is none.
        /// </summary>
        /// <remarks>
        /// A site's own view at a path wins over one in a Razor class library. On a site that compiles
        /// views as they are used, a view that does not compile throws here.
        /// </remarks>
        public IView? FindView(string path)
        {
            // Not a main page, so the site's _ViewStart files (and their layouts) are not applied.
            var result = _viewEngine.GetView(executingFilePath: null, viewPath: path, isMainPage: false);

            return result.Success ? result.View : null;
        }

        public async Task<string> RenderAsync(IView view, EmailData model)
        {
            // A context of its own, with the scope's services: the visitor's request may be over by the
            // time a handler runs, so its context is not used.
            var httpContext = new DefaultHttpContext { RequestServices = _services };
            var actionContext = new ActionContext(httpContext, new RouteData(), new ActionDescriptor());
            var viewData = new ViewDataDictionary<EmailData>(new EmptyModelMetadataProvider(), new ModelStateDictionary())
            {
                Model = model,
            };
            var tempData = new TempDataDictionary(httpContext, _tempDataProvider);

            await using var writer = new StringWriter();
            var viewContext = new ViewContext(actionContext, view, viewData, tempData, writer, new HtmlHelperOptions());
            await view.RenderAsync(viewContext);

            return writer.ToString();
        }
    }
}
