namespace Formulate.Extensions.StoreData.Utilities
{
    using Formulate.Core.FormFields;
    using Formulate.Core.Types;
    using Formulate.Extensions.StoreData.Models;

    internal sealed class StoreFields : IStoreFields
    {
        private readonly FormFieldDefinitionCollection _fieldDefinitions;

        public StoreFields(FormFieldDefinitionCollection fieldDefinitions)
        {
            _fieldDefinitions = fieldDefinitions;
        }

        public IReadOnlyCollection<StoreDataEntry> Execute(StoreFieldsInput input)
        {
            var entries = new List<StoreDataEntry>();

            var fields = input.Fields;
            var form = input.Form;

            // Normal fields.
            foreach (var kvp in fields)
            {
                var values = kvp.Value.GetValues();
                var formatted = string.Join(", ", values.Select(x => x ?? string.Empty));
                var field = form.Fields.FirstOrDefault(x => x.Id == kvp.Key);

                if (field is null)
                {
                    continue;
                }

                // A field whose definition is not stored (reCAPTCHA) was posted to be checked, not kept, as in Formulate 3.
                // A kind that is not installed has no definition to ask, so its values are kept.
                if (_fieldDefinitions.FirstOrDefault(field.KindId)?.IsStored == false)
                {
                    continue;
                }

                entries.Add(new StoreDataEntry()
                {
                    FieldId = kvp.Key,
                    FieldName = field.Name,
                    Value = formatted
                });
            }

            return entries;
        }
    }
}