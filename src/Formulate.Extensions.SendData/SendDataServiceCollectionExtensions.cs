namespace Formulate.Extensions.SendData
{
    using Formulate.Extensions.SendData.Utilities;
    using Microsoft.Extensions.DependencyInjection;

    /// <summary>
    /// Registers the services the Send Data handler resolves for each submission.
    /// </summary>
    internal static class SendDataServiceCollectionExtensions
    {
        /// <summary>
        /// The time a request may take. The Send Data handler runs while the visitor waits for the
        /// submission's result, so it cannot wait for long.
        /// </summary>
        internal static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(30);

        public static IServiceCollection AddFormulateSendData(this IServiceCollection services)
        {
            // A site can configure this client further with AddHttpClient(Constants.HttpClientName).
            services
                .AddHttpClient(Constants.HttpClientName, client => client.Timeout = RequestTimeout)

                // A redirect is not followed, as in Formulate 3: the data would go to a URL the site owner did not choose.
                // Cookies are not kept: the factory shares the handler between visitors' requests, so a cookie a receiver
                // sets for one visitor would go with the next visitor's request. Formulate 3 never sent cookies.
                .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler { AllowAutoRedirect = false, UseCookies = false })

                // The client's own logging writes the full URL, and for Query String that is the visitor's data.
                .RemoveAllLoggers();

            services.AddScoped<ISubmissionPageResolver, SubmissionPageResolver>();
            services.AddScoped<SendDataWorker>();

            return services;
        }
    }
}
