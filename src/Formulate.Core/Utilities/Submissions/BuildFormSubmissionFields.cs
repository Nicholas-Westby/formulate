namespace Formulate.Core.Utilities.Submissions
{
    using System;
    using System.Collections.Generic;
    using Formulate.Core.FormFields;
    using Formulate.Core.Submissions.Requests;

    internal sealed class BuildFormSubmissionFields : IBuildFormSubmissionFields
    {
        private readonly IFormFieldFactory _formFieldFactory;

        public BuildFormSubmissionFields(IFormFieldFactory formFieldFactory)
        {
            _formFieldFactory = formFieldFactory;
        }

        public FormSubmissionFields Build(FormSubmissionRequest input)
        {
            var items = new List<SubmissionField>();

            foreach (var persisted in input.Form.Fields ?? Array.Empty<PersistedFormField>())
            {
                var field = _formFieldFactory.Create(persisted);

                if (field is not null)
                {
                    items.Add(new SubmissionField(persisted, field));
                }
            }

            return new FormSubmissionFields(items);
        }
    }
}
