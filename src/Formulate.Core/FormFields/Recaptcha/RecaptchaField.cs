namespace Formulate.Core.FormFields.Recaptcha
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Threading;
    using System.Threading.Tasks;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Core.Validations;
    using Microsoft.Extensions.Logging;

    /// <summary>
    /// A reCAPTCHA (v2 checkbox). The visitor's response token is posted under the field's ID and checked with
    /// Google once every other field is valid. It fails closed: any problem is an error on the field.
    /// </summary>
    public sealed class RecaptchaField : FormField<RecaptchaFieldConfiguration>, IVerifiedFormField
    {
        /// <summary>
        /// The message when the site has no secret key.
        /// </summary>
        public const string NotConfiguredMessage = "reCAPTCHA is not set up on this site, so this form cannot be sent.";

        /// <summary>
        /// The message when the visitor did not solve the reCAPTCHA.
        /// </summary>
        public const string MissingTokenMessage = "Please solve the reCAPTCHA.";

        /// <summary>
        /// The message when Google says the response is not good.
        /// </summary>
        public const string FailedMessage = "The reCAPTCHA failed. Please try again.";

        /// <summary>
        /// The message when Google could not be asked.
        /// </summary>
        public const string UnavailableMessage = "The reCAPTCHA could not be checked. Please try again.";

        private readonly string _secretKey;

        private readonly IRecaptchaVerifier _verifier;

        private readonly ILogger _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="RecaptchaField"/> class.
        /// </summary>
        /// <param name="settings">The form field settings.</param>
        /// <param name="configuration">The configuration (the site key).</param>
        /// <param name="secretKey">The secret key, which may be empty when it is not set.</param>
        /// <param name="verifier">The verifier.</param>
        /// <param name="logger">The logger.</param>
        public RecaptchaField(IFormFieldSettings settings, RecaptchaFieldConfiguration configuration, string secretKey, IRecaptchaVerifier verifier, ILogger logger) : base(settings, configuration)
        {
            _secretKey = secretKey;
            _verifier = verifier;
            _logger = logger;
        }

        /// <inheritdoc />
        public async Task<FormFieldValidationResult> VerifyAsync(IFormFieldValues values, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(_secretKey))
            {
                _logger.LogWarning(
                    "The form field {FieldName} ({FieldId}) refused a submission because the reCAPTCHA secret key is not set. Set Formulate:Recaptcha:SecretKey.",
                    Name,
                    Id);

                return Fail(NotConfiguredMessage);
            }

            var posted = values is IStringFormFieldValues strings ? strings.GetValues().ToArray() : Array.Empty<string>();

            // The widget posts one token. Anything else is not one.
            if (posted.Length != 1 || string.IsNullOrWhiteSpace(posted[0]))
            {
                _logger.LogInformation(
                    "The form field {FieldName} ({FieldId}) refused a submission because it has no reCAPTCHA response ({Count} values were posted).",
                    Name,
                    Id,
                    posted.Length);

                return Fail(MissingTokenMessage);
            }

            RecaptchaVerification verification;

            try
            {
                verification = await _verifier.VerifyAsync(_secretKey, posted[0], cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                // The visitor went away: there is nobody to tell.
                throw;
            }
            catch (Exception ex)
            {
                // A timeout, an unreachable Google, a bad status or a reply that is not readable.
                _logger.LogError(
                    ex,
                    "The form field {FieldName} ({FieldId}) refused a submission because Google could not verify the reCAPTCHA response.",
                    Name,
                    Id);

                return Fail(UnavailableMessage);
            }

            if (verification.Success == false)
            {
                _logger.LogWarning(
                    "The form field {FieldName} ({FieldId}) refused a submission because Google rejected the reCAPTCHA response. Google's error codes: {ErrorCodes}.",
                    Name,
                    Id,
                    verification.ErrorCodes is { Count: > 0 } ? string.Join(", ", verification.ErrorCodes) : "(none)");

                return Fail(FailedMessage);
            }

            return new FormFieldValidationResult();
        }

        private static FormFieldValidationResult Fail(string message)
        {
            return new FormFieldValidationResult { ErrorMessages = new[] { message } };
        }
    }
}
