namespace Formulate.BackOffice.Api.Models.Folder
{
    /// <summary>
    /// Renames a folder. The folder keeps its alias and its place in the tree.
    /// </summary>
    public sealed class UpdateFolderRequestModel
    {
        /// <summary>
        /// Gets the name.
        /// </summary>
        public string Name { get; init; } = string.Empty;
    }
}
