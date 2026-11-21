namespace Formulate.BackOffice.PropertyEditors
{
    using Formulate.Core.PropertyEditors;
    using Umbraco.Cms.Core.PropertyEditors;

    /// <summary>
    /// The server side of the form layout picker property editor.
    /// </summary>
    /// <remarks>
    /// The name, icon, group, and UI come from the client manifest.
    /// </remarks>
    [DataEditor(FormLayoutPickerPropertyValueConverter.PropertyEditorAlias, ValueType = ValueTypes.Json)]
    public sealed class FormLayoutPickerPropertyEditor : DataEditor
    {
        public FormLayoutPickerPropertyEditor(IDataValueEditorFactory dataValueEditorFactory)
            : base(dataValueEditorFactory)
        {
        }
    }
}
