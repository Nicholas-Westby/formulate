namespace Formulate.Extensions.PlainJavaScriptTemplate.Controllers
{
    public sealed class SubmissionRequest
    {
        public Guid FormId { get; set; }

        /// <summary>
        /// Gets or sets the ID of the content page the form is on, or null when it is not on one.
        /// </summary>
        public int? PageId { get; set; }
    }
}