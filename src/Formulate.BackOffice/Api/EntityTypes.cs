namespace Formulate.BackOffice.Api
{
    /// <summary>
    /// The entity types the Management API shares with the back office client.
    /// </summary>
    public static class EntityTypes
    {
        /// <summary>
        /// The root of the Forms tree.
        /// </summary>
        public const string FormsRoot = "formulate-forms-root";

        /// <summary>
        /// A folder in the Forms tree.
        /// </summary>
        public const string FormFolder = "formulate-form-folder";

        /// <summary>
        /// A form.
        /// </summary>
        public const string Form = "formulate-form";

        /// <summary>
        /// A layout, which belongs to a form.
        /// </summary>
        public const string Layout = "formulate-layout";

        /// <summary>
        /// The root of the Data Values tree.
        /// </summary>
        public const string DataValuesRoot = "formulate-data-values-root";

        /// <summary>
        /// A folder in the Data Values tree.
        /// </summary>
        public const string DataValuesFolder = "formulate-data-values-folder";

        /// <summary>
        /// A data values item.
        /// </summary>
        public const string DataValues = "formulate-data-values";

        /// <summary>
        /// The root of the Validations tree.
        /// </summary>
        public const string ValidationsRoot = "formulate-validations-root";

        /// <summary>
        /// A folder in the Validations tree.
        /// </summary>
        public const string ValidationFolder = "formulate-validation-folder";

        /// <summary>
        /// A validation.
        /// </summary>
        public const string Validation = "formulate-validation";
    }
}
