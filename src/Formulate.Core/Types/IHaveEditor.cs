namespace Formulate.Core.Types
{
    /// <summary>
    /// For implementations that have a back office editor alias.
    /// </summary>
    public interface IHaveEditor
    {
        /// <summary>
        /// Gets the editor alias.
        /// </summary>
        string EditorAlias { get; }
    }
}
