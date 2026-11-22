namespace Formulate.Extensions.PlainJavaScriptTemplate.Core
{
    using Microsoft.AspNetCore.Builder;
    using Microsoft.AspNetCore.Http;
    using Umbraco.Cms.Web.Common.ApplicationBuilder;

    /// <summary>
    /// Sends <c>Cache-Control: no-cache</c> with every response under /App_Plugins/Formulate/PlainJavaScript/ (under
    /// the site's path base): the renderer's modules, their list and the themes.
    /// </summary>
    /// <remarks>
    /// The files keep their URLs from one version to the next, because the modules import each other by those URLs
    /// and a second URL for a file would load a second copy of it. So a browser has to check with the server before
    /// it uses a copy it has (the server answers 304 when the file has not changed), or a visitor could keep running
    /// an old renderer after an upgrade. The header replaces any Cache-Control the site gives static files.
    /// </remarks>
    public static class PlainJavaScriptCaching
    {
        /// <summary>The folder of the renderer's files, under the site's path base.</summary>
        public const string FolderPath = "/App_Plugins/Formulate/PlainJavaScript";

        /// <summary>The Cache-Control header the files get.</summary>
        public const string CacheControl = "no-cache";

        /// <summary>The name of the Umbraco pipeline filter that adds the header.</summary>
        public const string PipelineFilterName = "Formulate.PlainJavaScript.Caching";

        /// <summary>
        /// Adds the pipeline filter that sets the header. It runs before Umbraco's own middleware, so before the
        /// static files middleware answers.
        /// </summary>
        public static void AddPipelineFilter(UmbracoPipelineOptions options)
        {
            options.AddFilter(new UmbracoPipelineFilter(PipelineFilterName)
            {
                PrePipeline = app => app.UseFormulatePlainJavaScriptCaching(),
            });
        }

        /// <summary>
        /// Adds the middleware that sets <c>Cache-Control: no-cache</c> on the responses to requests for the
        /// renderer's files. Umbraco sites get it from the template's composer.
        /// </summary>
        public static IApplicationBuilder UseFormulatePlainJavaScriptCaching(this IApplicationBuilder app)
        {
            return app.Use((context, next) =>
            {
                if (context.Request.Path.StartsWithSegments(FolderPath, StringComparison.OrdinalIgnoreCase))
                {
                    // Set as the response starts, so it replaces whatever a later middleware (such as the
                    // static files middleware, with the site's options) put there.
                    var response = context.Response;
                    response.OnStarting(() =>
                    {
                        response.Headers.CacheControl = CacheControl;
                        return Task.CompletedTask;
                    });
                }

                return next(context);
            });
        }
    }
}
