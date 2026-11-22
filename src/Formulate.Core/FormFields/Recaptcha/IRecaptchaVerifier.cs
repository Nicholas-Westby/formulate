namespace Formulate.Core.FormFields.Recaptcha
{
    using System.Threading;
    using System.Threading.Tasks;

    /// <summary>
    /// Asks Google whether a reCAPTCHA response token is good.
    /// </summary>
    public interface IRecaptchaVerifier
    {
        /// <summary>
        /// Verifies a response token.
        /// </summary>
        /// <param name="secretKey">The site's secret key.</param>
        /// <param name="token">The response token the visitor's browser posted.</param>
        /// <param name="cancellationToken">A token that cancels the call.</param>
        /// <returns>Google's answer.</returns>
        /// <exception cref="System.Exception">
        /// Google could not be reached, did not answer in time or gave an answer that could not be read. The
        /// caller must treat any exception as a failed verification.
        /// </exception>
        Task<RecaptchaVerification> VerifyAsync(string secretKey, string token, CancellationToken cancellationToken);
    }
}
