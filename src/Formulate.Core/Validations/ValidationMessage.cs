namespace Formulate.Core.Validations
{
    using System;
    using System.Text.RegularExpressions;
    using TokenRegex = System.Text.RegularExpressions.Regex;
    using Formulate.Core.FormFields;

    /// <summary>
    /// Helpers for the text of a validation message.
    /// </summary>
    public static class ValidationMessage
    {
        private static readonly TokenRegex FieldTokens = new TokenRegex(
            @"\{(name|alias|label|\{)\}", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, TimeSpan.FromSeconds(1));

        /// <summary>
        /// Replaces the placeholders in a validation message with the field's own values, as Formulate 3 did.
        /// The match ignores letter case. <c>{name}</c>, <c>{alias}</c> and <c>{label}</c> become the field's
        /// name, alias and label (the name when the field has no label, as the page shows it), and <c>{{}</c>
        /// becomes <c>{</c>. Any other text is left as it is.
        /// </summary>
        /// <param name="message">The message, which may be null or empty.</param>
        /// <param name="field">The field the message is shown for.</param>
        /// <returns>The message with the placeholders replaced.</returns>
        public static string ReplaceFieldTokens(string message, IFormField field)
        {
            if (string.IsNullOrEmpty(message) || field is null)
            {
                return message;
            }

            return FieldTokens.Replace(message, match =>
            {
                switch (match.Groups[1].Value.ToLowerInvariant())
                {
                    case "name":
                        return field.Name ?? string.Empty;
                    case "alias":
                        return field.Alias ?? string.Empty;
                    case "label":
                        return field.Label ?? field.Name ?? string.Empty;
                    default:
                        return "{";
                }
            });
        }
    }
}
