namespace Formulate.Extensions.SendEmail.Utilities
{
    using Formulate.Core.FormHandlers;
    using Formulate.Core.Submissions.Requests;

    /// <summary>
    /// The submission and the handler an email is for, so every log message can name both.
    /// </summary>
    internal readonly record struct EmailHandlerContext(FormSubmissionRequest Submission, IFormHandler Handler)
    {
        public Guid FormId => Submission.Form?.Id ?? Guid.Empty;

        public string? FormName => Submission.Form?.Name;

        public Guid HandlerId => Handler.Id;

        public string? HandlerName => Handler.Name;
    }
}
