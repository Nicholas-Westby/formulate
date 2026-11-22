namespace Formulate.BackOffice
{
    /// <summary>
    /// A root class for various constants related to the Formulate BackOffice.
    /// </summary>
    public static partial class Constants
    {
        /// <summary>
        /// The alias of the Formulate section.
        /// </summary>
        /// <remarks>
        /// The back office client registers the section under this alias, and user groups store it
        /// unchanged: the Management API only translates Umbraco's own sections, such as "content" to
        /// "Umb.Section.Content".
        /// </remarks>
        public const string SectionAlias = "Formulate.Section";

        /// <summary>
        /// The name of the Formulate Management API, which groups its controllers into one OpenAPI document.
        /// </summary>
        public const string ApiName = "formulate";
    }
}
