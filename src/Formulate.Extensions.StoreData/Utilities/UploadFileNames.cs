namespace Formulate.Extensions.StoreData.Utilities
{
    using System.Globalization;
    using System.Text;

    /// <summary>
    /// Turns the file name a visitor sent into one that is safe to create on the server.
    /// </summary>
    internal static class UploadFileNames
    {
        /// <summary>
        /// The longest name, in UTF-8 bytes, that is kept. File systems allow 255 bytes, and the rest
        /// leaves room for a " (2)" suffix.
        /// </summary>
        internal const int MaxBytes = 200;

        private const int MaxExtensionBytes = 40;

        private const string Fallback = "file";

        private static readonly char[] ExtraInvalidCharacters = { '\\', '/', ':', '*', '?', '"', '<', '>', '|' };

        private static readonly HashSet<string> ReservedNames = new(StringComparer.OrdinalIgnoreCase)
        {
            "CON", "PRN", "AUX", "NUL",
            "COM0", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "COM\u00B9", "COM\u00B2", "COM\u00B3",
            "LPT0", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9", "LPT\u00B9", "LPT\u00B2", "LPT\u00B3",
        };

        /// <summary>
        /// Gets a safe file name, never empty, from the name the client sent.
        /// </summary>
        /// <remarks>
        /// Any folder part is dropped, whichever separator the client's system uses. Characters that are
        /// invalid in a file name on any system, control characters and Unicode format characters (such
        /// as the right-to-left override) are replaced. The result is at most <see cref="MaxBytes"/> UTF-8 bytes.
        /// </remarks>
        /// <param name="clientName">The name the client sent.</param>
        public static string Sanitize(string? clientName)
        {
            var name = clientName ?? string.Empty;

            // Drop any folder part. Path.GetFileName alone would keep "C:\x.dll" whole on Linux.
            var lastSeparator = name.LastIndexOfAny(new[] { '/', '\\' });
            name = name[(lastSeparator + 1)..];

            var builder = new StringBuilder(name.Length);
            var invalid = Path.GetInvalidFileNameChars();

            foreach (var rune in name.EnumerateRunes())
            {
                var replace = Rune.GetUnicodeCategory(rune) is UnicodeCategory.Format or UnicodeCategory.Control
                    || (rune.IsBmp && (Array.IndexOf(invalid, (char)rune.Value) >= 0
                        || Array.IndexOf(ExtraInvalidCharacters, (char)rune.Value) >= 0));
                builder.Append(replace ? "_" : rune.ToString());
            }

            // Windows drops trailing dots and spaces, which would make "x.dll." mean "x.dll".
            name = builder.ToString().Trim(' ').TrimEnd('.', ' ');

            if (name.Length == 0)
            {
                return Fallback;
            }

            // The cut can leave a bare device name ("CON" + spaces + "x.txt" becomes "CON.txt"), so check after it.
            name = Truncate(name);

            return IsReserved(name) ? Truncate("_" + name) : name;
        }

        private static bool IsReserved(string name)
        {
            var firstDot = name.IndexOf('.');
            var stem = (firstDot < 0 ? name : name[..firstDot]).Trim(' ');

            return ReservedNames.Contains(stem);
        }

        /// <summary>
        /// Gets <paramref name="name"/>, or when it is taken, the name with " (2)", " (3)" and so on
        /// before its extension, and adds the result to <paramref name="taken"/>.
        /// </summary>
        /// <param name="name">A name from <see cref="Sanitize"/>.</param>
        /// <param name="taken">The names already used in the folder. Names compare without regard to case.</param>
        public static string MakeUnique(string name, ISet<string> taken)
        {
            var candidate = name;

            if (taken.Contains(candidate))
            {
                var extension = Path.GetExtension(name);
                var stem = name[..^extension.Length];
                var counter = 2;

                do
                {
                    candidate = $"{stem} ({counter}){extension}";
                    counter++;
                }
                while (taken.Contains(candidate));
            }

            taken.Add(candidate);
            return candidate;
        }

        private static string Truncate(string name)
        {
            if (Encoding.UTF8.GetByteCount(name) <= MaxBytes)
            {
                return name;
            }

            var extension = CutToBytes(Path.GetExtension(name), MaxExtensionBytes).TrimEnd(' ', '.');
            var stem = name[..^Path.GetExtension(name).Length];
            stem = CutToBytes(stem, MaxBytes - Encoding.UTF8.GetByteCount(extension)).TrimEnd(' ', '.');

            if (stem.Length == 0)
            {
                stem = Fallback;
            }

            return stem + extension;
        }

        /// <summary>
        /// Cuts text to at most a number of UTF-8 bytes, never in the middle of a character.
        /// </summary>
        private static string CutToBytes(string text, int maxBytes)
        {
            var builder = new StringBuilder();
            var bytes = 0;

            foreach (var rune in text.EnumerateRunes())
            {
                bytes += rune.Utf8SequenceLength;

                if (bytes > maxBytes)
                {
                    break;
                }

                builder.Append(rune.ToString());
            }

            return builder.ToString();
        }
    }
}
