namespace Formulate.Extensions.StoreData.Services
{
    using System.Globalization;
    using System.Text;
    using Formulate.Extensions.StoreData.Api.Models;

    /// <summary>
    /// Writes submissions as CSV (RFC 4180), safe to open in a spreadsheet.
    /// </summary>
    internal static class CsvExporter
    {
        private const string LineEnd = "\r\n";

        private static readonly char[] FormulaStarts = { '=', '+', '-', '@', '\t', '\r' };

        /// <summary>
        /// A column for each field, in the form's order.
        /// </summary>
        public readonly record struct Column(Guid FieldId, string Name);

        /// <summary>
        /// Gets the UTF-8 byte order mark, which makes Excel read the file as UTF-8.
        /// </summary>
        public static byte[] ByteOrderMark => Encoding.UTF8.GetPreamble();

        /// <summary>
        /// Gets the headers of the columns that come before the fields.
        /// </summary>
        public static readonly IReadOnlyList<string> FixedHeaders = new[] { "Submission Id", "Created", "Page Id", "URL" };

        public static void WriteHeader(TextWriter writer, IReadOnlyList<Column> columns)
        {
            var cells = new List<string>(FixedHeaders);
            cells.AddRange(columns.Select(x => x.Name));
            WriteRow(writer, cells);
        }

        public static void WriteRow(TextWriter writer, IReadOnlyList<Column> columns, SubmissionResponseModel submission)
        {
            var cells = new List<string>
            {
                submission.Id.ToString("D"),
                DateTime.SpecifyKind(submission.CreationDate, DateTimeKind.Utc)
                    .ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture),
                submission.PageId?.ToString(CultureInfo.InvariantCulture) ?? string.Empty,
                submission.Url ?? string.Empty,
            };

            foreach (var column in columns)
            {
                var values = submission.Values.Where(x => x.FieldId == column.FieldId).Select(x => x.Value)
                    .Concat(submission.Files.Where(x => x.FieldId == column.FieldId).Select(x => x.FileName));
                cells.Add(string.Join(", ", values));
            }

            WriteRow(writer, cells);
        }

        /// <summary>
        /// Prepares text for a CSV cell. A value a spreadsheet would run as a formula is made text
        /// with a leading apostrophe, and a value with a comma, quote or line break is quoted.
        /// </summary>
        public static string Cell(string value)
        {
            if (value.Length == 0)
            {
                return value;
            }

            value = Neutralize(value);

            return value.IndexOfAny(new[] { ',', '"', '\r', '\n' }) >= 0
                ? "\"" + value.Replace("\"", "\"\"") + "\""
                : value;
        }

        /// <summary>
        /// Puts an apostrophe before a formula start at the start of the value and after any ";", CR or LF
        /// (looking past one optional quote). Excel with a semicolon list separator ends a cell at ";" and,
        /// because a quote in the middle of a row does not open a quoted field, ends the record at a line
        /// break, so what follows is the first thing in a cell.
        /// </summary>
        private static string Neutralize(string value)
        {
            var builder = new StringBuilder(value.Length + 2);
            var i = 0;

            while (i < value.Length)
            {
                var boundary = i == 0 || value[i - 1] is ';' or '\r' or '\n';

                if (boundary && value[i] == '"')
                {
                    builder.Append('"');
                    i++;

                    if (i == value.Length)
                    {
                        break;
                    }
                }
                else if (!boundary)
                {
                    builder.Append(value[i++]);
                    continue;
                }

                if (Array.IndexOf(FormulaStarts, value[i]) >= 0)
                {
                    builder.Append('\'');
                }

                builder.Append(value[i++]);
            }

            return builder.ToString();
        }

        private static void WriteRow(TextWriter writer, IEnumerable<string> cells)
        {
            writer.Write(string.Join(",", cells.Select(Cell)));
            writer.Write(LineEnd);
        }
    }
}
