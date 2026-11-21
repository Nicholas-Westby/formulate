namespace Formulate.Web.Persistence
{
    /// <summary>
    /// A settings class required to create a <see cref="WebHostRepositoryUtility{TPersistedEntity}"/>.
    /// </summary>
    internal sealed class WebHostRepositoryUtilitySettings
    {
        public WebHostRepositoryUtilitySettings(string basePath, string extension) : this(basePath, extension, $"*{extension}")
        {
        }

        public WebHostRepositoryUtilitySettings(string basePath, string extension, string wildcard)
        {
            BasePath = basePath;
            Extension = extension;
            Wildcard = wildcard;
        }

        /// <summary>
        /// Gets the base path to JSON files.
        /// </summary>
        public string BasePath { get; }

        /// <summary>
        /// Gets the extension of JSON files.
        /// </summary>
        public string Extension { get; }

        /// <summary>
        /// Gets the wildcard used to match JSON files.
        /// </summary>
        public string Wildcard { get; }

        /// <summary>
        /// Settings used for data values entities.
        /// </summary>
        public static readonly WebHostRepositoryUtilitySettings DataValues = new("DataValues", ".dataValue");

        /// <summary>
        /// Settings used for form entities.
        /// </summary>
        public static readonly WebHostRepositoryUtilitySettings Forms = new("Forms", ".form");

        /// <summary>
        /// Settings used for folder entities.
        /// </summary>
        public static readonly WebHostRepositoryUtilitySettings Folders = new("Folders", ".folder");

        /// <summary>
        /// Settings used for layout entities.
        /// </summary>
        public static readonly WebHostRepositoryUtilitySettings Layouts = new("Layouts", ".layout");

        /// <summary>
        /// Settings used for validation entities.
        /// </summary>
        public static readonly WebHostRepositoryUtilitySettings Validations = new("Validations", ".validation");
    }
}
