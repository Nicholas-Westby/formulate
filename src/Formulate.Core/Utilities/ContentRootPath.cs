namespace Formulate.Core.Utilities
{
    using System.IO;

    /// <summary>
    /// Resolves a configured folder setting to a full path.
    /// </summary>
    public static class ContentRootPath
    {
        /// <summary>
        /// Resolves a configured folder to a full path.
        /// </summary>
        /// <remarks>
        /// A leading "~/" or "~\" and a plain relative path are relative to the content root. Any
        /// other rooted path (such as "/var/formulate" or "C:\data") is used as is.
        /// </remarks>
        /// <param name="configured">The configured folder.</param>
        /// <param name="contentRootPath">The content root.</param>
        public static string Resolve(string configured, string contentRootPath)
        {
            if (configured.StartsWith("~/") || configured.StartsWith("~\\"))
            {
                configured = configured.Substring(2)
                    .Replace('\\', Path.DirectorySeparatorChar)
                    .TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            }

            return Path.GetFullPath(configured, contentRootPath);
        }
    }
}
