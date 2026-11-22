namespace Formulate.Extensions.SendEmail.DesignedEmail
{
    /// <summary>
    /// The paths of a designed email's views.
    /// </summary>
    /// <remarks>
    /// The built-in samples are compiled into this library. A site replaces one by putting its own file at
    /// the sample's path: a site that compiles its views at runtime (Umbraco's InMemoryAuto models mode)
    /// sees that the file differs from the sample's recorded checksum, and a precompiled site's own views
    /// come before the library's.
    /// </remarks>
    internal static class EmailViewPaths
    {
        /// <summary>
        /// The built-in subject sample.
        /// </summary>
        public const string SampleSubject = "~/Views/Formulate/Email/Sample (Subject).cshtml";

        /// <summary>
        /// The built-in HTML sample, also used when a handler has no HTML or text view.
        /// </summary>
        public const string SampleHtml = "~/Views/Formulate/Email/Sample (HTML).cshtml";

        /// <summary>
        /// The built-in text sample.
        /// </summary>
        public const string SampleText = "~/Views/Formulate/Email/Sample (Text).cshtml";

        /// <summary>
        /// Formulate Pro's samples, which Pro copied into sites, and the built-in sample for each.
        /// </summary>
        private static readonly Dictionary<string, string> ProSamples = new(StringComparer.OrdinalIgnoreCase)
        {
            ["~/Views/Formulate/Email/Formulate Pro Sample (Subject).cshtml"] = SampleSubject,
            ["~/Views/Formulate/Email/Formulate Pro Sample (HTML).cshtml"] = SampleHtml,
            ["~/Views/Formulate/Email/Formulate Pro Sample (Text).cshtml"] = SampleText,
        };

        /// <summary>
        /// Turns a path written as Formulate Pro took it ("Views\Email.cshtml", "/Views/Email.cshtml" or
        /// "~/Views/Email.cshtml") into the app relative path Razor finds views by ("~/Views/Email.cshtml").
        /// Null when the path is blank.
        /// </summary>
        public static string? Normalize(string? path)
        {
            var value = path?.Trim().Replace('\\', '/');

            if (string.IsNullOrEmpty(value))
            {
                return null;
            }

            return "~/" + value.TrimStart('~').TrimStart('/');
        }

        /// <summary>
        /// Gets the built-in sample to use in place of one of Formulate Pro's samples, or null when the
        /// path is not one of them.
        /// </summary>
        public static string? GetBuiltInSample(string path)
        {
            return ProSamples.TryGetValue(path, out var sample) ? sample : null;
        }
    }
}
