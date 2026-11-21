namespace Formulate.Web.Utilities
{
    using Microsoft.AspNetCore.Http;

    public sealed class AttemptSubmitFormInput
    {
        public AttemptSubmitFormInput(Guid formId, int? pageId, IFormCollection form, IFormFileCollection files)
        {
            Files = files;
            Form = form;
            FormId = formId;
            PageId = pageId;
        }

        public IFormFileCollection Files { get; init; }

        public IFormCollection Form { get; init; }

        public Guid FormId { get; init; }

        /// <summary>
        /// Gets the ID of the content page the form was on, or null when it was not on one.
        /// </summary>
        public int? PageId { get; init; }
    }
}
