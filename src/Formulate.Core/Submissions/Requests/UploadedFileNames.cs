namespace Formulate.Core.Submissions.Requests
{
    using System.Globalization;
    using System.Text;

    /// <summary>
    /// Cleans the file names that browsers send with uploads: drops any folder part and replaces control and
    /// Unicode format characters.
    /// </summary>
    /// <remarks>
    /// Store Data and the email handlers both start from this, so neither keeps a folder part or a hidden
    /// character such as the right-to-left override. They do not give a file the same name: Store Data
    /// replaces those characters with "_" and then applies its own rules for the file system (invalid
    /// characters, reserved device names, a length cap and a " (2)" suffix for a name already taken), while
    /// the email handlers remove them and keep the rest of the name.
    /// </remarks>
    public static class UploadedFileNames
    {
        private static readonly char[] Separators = { '/', '\\' };

        /// <summary>
        /// Gets the last part of the name a browser sent, with each character that cannot be seen replaced.
        /// </summary>
        /// <remarks>
        /// Any folder part is dropped, whichever separator the visitor's system uses (Path.GetFileName
        /// alone would keep "C:\x.dll" whole on Linux). Control characters and Unicode format characters
        /// (category Cf) are replaced: a format character such as U+202E, the right-to-left override,
        /// makes "invoice[U+202E]fdp.exe" show as "invoiceexe.pdf".
        /// </remarks>
        /// <param name="clientName">The name the browser sent.</param>
        /// <param name="replacement">The text to put in place of each hidden character, such as "_" or "".</param>
        public static string Clean(string clientName, string replacement)
        {
            var name = clientName ?? string.Empty;
            name = name.Substring(name.LastIndexOfAny(Separators) + 1);

            var builder = new StringBuilder(name.Length);

            foreach (var rune in name.EnumerateRunes())
            {
                if (IsHidden(rune))
                {
                    builder.Append(replacement);
                }
                else
                {
                    builder.Append(rune.ToString());
                }
            }

            return builder.ToString();
        }

        private static bool IsHidden(Rune rune)
        {
            return Rune.GetUnicodeCategory(rune) is UnicodeCategory.Format or UnicodeCategory.Control;
        }
    }
}
