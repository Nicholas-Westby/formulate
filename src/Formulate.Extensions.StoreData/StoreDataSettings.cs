namespace Formulate.Extensions.StoreData
{
    /// <summary>
    /// The Store Data settings, read from the "Formulate:StoreData" configuration section.
    /// </summary>
    public sealed class StoreDataSettings
    {
        /// <summary>
        /// The configuration section.
        /// </summary>
        public const string SectionName = "Formulate:StoreData";

        /// <summary>
        /// The default for <see cref="UploadsFolderPath"/>.
        /// </summary>
        public const string DefaultUploadsFolderPath = "App_Data/Formulate/Uploads";

        /// <summary>
        /// The default for <see cref="MaxUploadBytes"/>: 10 MB.
        /// </summary>
        public const long DefaultMaxUploadBytes = 10_485_760;

        /// <summary>
        /// Gets or sets the folder uploaded files are stored in. A relative path starts at the
        /// content root, never at the web root, so the files cannot be requested directly.
        /// </summary>
        public string UploadsFolderPath { get; set; } = DefaultUploadsFolderPath;

        /// <summary>
        /// Gets or sets the largest file, in bytes, that is stored. Larger files are dropped and logged.
        /// </summary>
        public long MaxUploadBytes { get; set; } = DefaultMaxUploadBytes;
    }
}
