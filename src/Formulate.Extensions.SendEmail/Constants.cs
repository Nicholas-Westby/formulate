namespace Formulate.Extensions.SendEmail
{
    /// <summary>
    /// Constants for the Send Email extension.
    /// </summary>
    public static partial class Constants
    {
        /// <summary>
        /// The email types Formulate gives Umbraco's email sender. A site's SendEmailNotification handler
        /// can use them to tell Formulate's emails apart.
        /// </summary>
        public static class EmailTypes
        {
            /// <summary>
            /// An email from the Email handler.
            /// </summary>
            public const string Email = "FormulateEmail";

            /// <summary>
            /// An email from the Designed Email handler.
            /// </summary>
            public const string DesignedEmail = "FormulateDesignedEmail";
        }

        /// <summary>
        /// Keys code can add to a submission's extra context, for example in a FormSubmittingNotification
        /// handler, to change the emails it sends. They are the keys Formulate 3 used.
        /// </summary>
        public static class ExtraContextKeys
        {
            /// <summary>
            /// More recipients, as a list of email addresses (or one address).
            /// </summary>
            public const string ExtraRecipients = "Formulate Core: Email: Extra Recipients";

            /// <summary>
            /// Text added to the end of the Email handler's subject.
            /// </summary>
            public const string ExtraSubject = "Formulate Core: Email: Extra Subject";

            /// <summary>
            /// Text added to the end of the Email handler's message.
            /// </summary>
            public const string ExtraMessage = "Formulate Core: Email: Extra Message";
        }
    }
}
