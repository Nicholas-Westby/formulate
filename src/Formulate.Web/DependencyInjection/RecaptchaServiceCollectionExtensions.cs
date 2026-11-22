namespace Formulate.Web.DependencyInjection
{
    using Formulate.Core.FormFields.Recaptcha;
    using Formulate.Web.Recaptcha;
    using Microsoft.Extensions.DependencyInjection;
    using Microsoft.Extensions.DependencyInjection.Extensions;

    /// <summary>
    /// Registers the services the reCAPTCHA field uses.
    /// </summary>
    internal static class RecaptchaServiceCollectionExtensions
    {
        public static IServiceCollection AddFormulateRecaptcha(this IServiceCollection services)
        {
            // A site can configure this client further with AddHttpClient(RecaptchaConstants.HttpClientName). A replacement handler must keep
            // AllowAutoRedirect and UseCookies false.
            services
                .AddHttpClient(RecaptchaVerifier.HttpClientName, client => client.Timeout = RecaptchaVerifier.DefaultTimeout)

                // A redirect is not followed: the secret would go to a URL Google did not choose.
                // Cookies are not kept: the factory shares the handler between visitors' requests, so a cookie Google
                // sets for one visitor's check would go with the next visitor's.
                .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler { AllowAutoRedirect = false, UseCookies = false })

                // The client's own logging writes the URL, and logs are not the place for anything about a request that
                // carries a secret.
                .RemoveAllLoggers();

            services.TryAddSingleton<IRecaptchaVerifier, RecaptchaVerifier>();

            return services;
        }
    }
}
