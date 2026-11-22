namespace Formulate.BackOffice.Api
{
    /// <summary>
    /// The tree aliases in Management API routes, as in formulate/tree/{treeAlias}/root.
    /// </summary>
    public static class TreeAliases
    {
        /// <summary>
        /// The Forms tree, which holds folders, forms and their layouts.
        /// </summary>
        public const string Forms = "forms";

        /// <summary>
        /// The Data Values tree.
        /// </summary>
        public const string DataValues = "data-values";

        /// <summary>
        /// The Validations tree.
        /// </summary>
        public const string Validations = "validations";
    }
}
