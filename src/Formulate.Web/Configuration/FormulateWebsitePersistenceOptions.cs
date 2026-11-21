namespace Formulate.Web.Configuration
{
    public sealed class FormulateWebsitePersistenceOptions
    {
        /// <summary>
        /// Gets or sets the folder the JSON files are stored in. A relative path is relative to the
        /// content root (never the web root, which is publicly served).
        /// </summary>
        public string DataFolderPath { get; set; } = "App_Data/Formulate/Json";
    }
}
