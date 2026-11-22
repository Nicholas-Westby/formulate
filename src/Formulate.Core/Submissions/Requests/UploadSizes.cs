namespace Formulate.Core.Submissions.Requests
{
    using System;
    using System.Globalization;

    /// <summary>
    /// Writes upload sizes for people, such as "10 MB".
    /// </summary>
    public static class UploadSizes
    {
        /// <summary>
        /// Describes a number of bytes in bytes, KB or MB, to one decimal place.
        /// </summary>
        public static string Describe(long bytes)
        {
            const long kilobyte = 1024;
            const long megabyte = kilobyte * 1024;

            if (bytes >= megabyte)
            {
                return string.Create(CultureInfo.InvariantCulture, $"{Math.Round(bytes / (double)megabyte, 1)} MB");
            }

            if (bytes >= kilobyte)
            {
                return string.Create(CultureInfo.InvariantCulture, $"{Math.Round(bytes / (double)kilobyte, 1)} KB");
            }

            return string.Create(CultureInfo.InvariantCulture, $"{bytes} bytes");
        }
    }
}
