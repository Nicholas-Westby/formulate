namespace Formulate.BackOffice.Api.Models.Config
{
    /// <summary>
    /// Puts a kind of form field into a group.
    /// </summary>
    public sealed class FieldCategoryModel
    {
        /// <summary>
        /// Gets the group.
        /// </summary>
        public required string Group { get; init; }

        /// <summary>
        /// Gets the kind of field.
        /// </summary>
        public required string Kind { get; init; }
    }
}
