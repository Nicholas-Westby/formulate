namespace Formulate.BackOffice.Api.Models.Config
{
    /// <summary>
    /// The settings the back office client needs.
    /// </summary>
    public sealed class FormulateConfigResponseModel
    {
        /// <summary>
        /// Gets the kinds of button a button field offers.
        /// </summary>
        public required string[] ButtonKinds { get; init; }

        /// <summary>
        /// Gets how kinds of form field are grouped.
        /// </summary>
        public required FieldCategoryModel[] FieldCategories { get; init; }
    }
}
