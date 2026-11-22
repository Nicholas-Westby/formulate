namespace Formulate.Core.FormFields.Recaptcha
{
    using System.Collections.Generic;

    /// <summary>
    /// Google's answer about a reCAPTCHA response token.
    /// </summary>
    /// <param name="Success">Whether Google says the token is good.</param>
    /// <param name="ErrorCodes">The error codes Google gave, such as "timeout-or-duplicate".</param>
    public sealed record RecaptchaVerification(bool Success, IReadOnlyCollection<string> ErrorCodes);
}
