namespace Formulate.Core.FormFields.Date
{
    using System;
    using System.Collections.Generic;
    using System.Globalization;
    using System.Linq;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Core.Validations;

    /// <summary>
    /// A date.
    /// </summary>
    /// <remarks>
    /// The renderer posts "yyyy-MM-dd". That is the only form the server accepts, whatever the visitor's
    /// language. An empty value is valid unless a Mandatory validation says otherwise.
    /// </remarks>
    public sealed class DateField : FormField
    {
        /// <summary>
        /// The message for a value that is not a "yyyy-MM-dd" date.
        /// </summary>
        public const string InvalidMessage = "Please enter a valid date.";

        private const string IsoFormat = "yyyy-MM-dd";

        /// <inheritdoc />
        public DateField(IFormFieldSettings settings) : base(settings)
        {
        }

        /// <inheritdoc />
        public DateField(IFormFieldSettings settings, IReadOnlyCollection<IValidation> validations) : base(settings, validations)
        {
        }

        /// <summary>
        /// Writes a date as "MMMM dd, yyyy" in the current culture, as Formulate 3 did. A value that is not a
        /// date is kept.
        /// </summary>
        /// <remarks>
        /// The current culture is the submit request's, which ASP.NET Core's request localization takes from
        /// the query string, a cookie or the Accept-Language header, or else the default request culture. It is
        /// not the culture of the page the form is on. The value is read without regard to culture: the Date
        /// field posts "yyyy-MM-dd" (or a JavaScript date) in every language.
        /// </remarks>
        /// <param name="value">The posted value.</param>
        /// <returns>The long date, or the value.</returns>
        public static string Format(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return value;
            }

            var text = value.Trim();
            var culture = CultureInfo.InvariantCulture;

            if (DateTime.TryParseExact(text, IsoFormat, culture, DateTimeStyles.None, out var date)
                || DateTime.TryParse(text, culture, DateTimeStyles.None, out date)

                // A JavaScript date, such as "Sat Nov 21 2026 10:30:00 GMT-0800 (Pacific Standard Time)".
                || (text.Length >= 24 && DateTime.TryParseExact(text[..24], "ddd MMM dd yyyy HH:mm:ss", culture, DateTimeStyles.None, out date)))
            {
                return date.ToString("MMMM dd, yyyy", CultureInfo.CurrentCulture);
            }

            return value;
        }

        /// <inheritdoc />
        protected override FormFieldValidationResult ValidateStrings(IStringFormFieldValues strings)
        {
            var result = base.ValidateStrings(strings);
            var invalid = strings.GetValues().Any(x => string.IsNullOrWhiteSpace(x) == false && IsIsoDate(x) == false);

            if (invalid == false)
            {
                return result;
            }

            // A value that is not a date is not "missing" too, so one message is enough.
            return new FormFieldValidationResult { ErrorMessages = new[] { InvalidMessage } };
        }

        private static bool IsIsoDate(string value)
        {
            return value.Length == IsoFormat.Length
                && value.All(x => x == '-' || (x >= '0' && x <= '9'))
                && DateTime.TryParseExact(value, IsoFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out _);
        }
    }
}
