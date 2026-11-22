namespace Formulate.Extensions.SendEmail.DesignedEmail
{
    using System.Runtime.Serialization;
    using Formulate.Extensions.SendEmail.Configuration;

    /// <summary>
    /// The configuration of the Designed Email handler, with the JSON names Formulate Pro stored.
    /// </summary>
    [DataContract]
    public sealed class DesignedEmailConfiguration : EmailHandlerConfiguration
    {
        /// <summary>
        /// Gets or sets the path of the view that writes the subject, such as
        /// "~/Views/Formulate/Email/Sample (Subject).cshtml". When it is blank, the subject is used.
        /// </summary>
        [DataMember(Name = "subjectRazorPath")]
        public string? SubjectRazorPath { get; set; }

        /// <summary>
        /// Gets or sets the path of the view that writes the HTML email, such as
        /// "~/Views/Formulate/Email/Sample (HTML).cshtml". When it and the text view's path are blank,
        /// that built-in sample is used.
        /// </summary>
        [DataMember(Name = "htmlEmailRazorPath")]
        public string? HtmlEmailRazorPath { get; set; }

        /// <summary>
        /// Gets or sets the path of the view that writes the plain text email, such as
        /// "~/Views/Formulate/Email/Sample (Text).cshtml". It is used when there is no HTML view, because
        /// Umbraco's email sender sends one body.
        /// </summary>
        [DataMember(Name = "textEmailRazorPath")]
        public string? TextEmailRazorPath { get; set; }
    }
}
