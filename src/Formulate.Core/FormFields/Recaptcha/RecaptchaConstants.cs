namespace Formulate.Core.FormFields.Recaptcha
{
    /// <summary>
    /// Constants for the reCAPTCHA field.
    /// </summary>
    public static class RecaptchaConstants
    {
        /// <summary>
        /// The name of the <see cref="System.Net.Http.HttpClient"/> the reCAPTCHA field verifies with. A site can
        /// configure it with <c>AddHttpClient("Formulate.Recaptcha")</c>, such as a proxy. A site that replaces the
        /// primary handler must keep a <see cref="System.Net.Http.SocketsHttpHandler"/> with
        /// <c>AllowAutoRedirect = false</c> (the secret would follow a redirect to a URL Google did not choose) and
        /// <c>UseCookies = false</c> (the handler is shared between visitors' requests), or it undoes both
        /// safeguards.
        /// </summary>
        public const string HttpClientName = "Formulate.Recaptcha";
    }
}
