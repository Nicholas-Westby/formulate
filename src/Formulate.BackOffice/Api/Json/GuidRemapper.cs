namespace Formulate.BackOffice.Api.Json
{
    using System;
    using System.Collections.Generic;
    using System.IO;
    using System.Linq;
    using Newtonsoft.Json;
    using Newtonsoft.Json.Linq;

    /// <summary>
    /// Replaces IDs inside stored JSON.
    /// </summary>
    public static class GuidRemapper
    {
        /// <summary>
        /// Replaces every string value that is a GUID in <paramref name="map"/>, at any depth, keeping the
        /// format and letter case the GUID was written in.
        /// </summary>
        /// <param name="json">The stored JSON. Text that is not JSON, or empty, comes back unchanged.</param>
        /// <param name="map">Old ID to new ID.</param>
        public static string? Remap(string? json, IReadOnlyDictionary<Guid, Guid> map)
        {
            if (string.IsNullOrWhiteSpace(json) || map.Count == 0)
            {
                return json;
            }

            JToken root;

            try
            {
                // Dates stay as the text they were written as, so nothing else changes.
                using var reader = new JsonTextReader(new StringReader(json)) { DateParseHandling = DateParseHandling.None };
                root = JToken.ReadFrom(reader);
            }
            catch (JsonException)
            {
                return json;
            }

            var changed = false;

            // A bare string at the root has no parent to replace it in.
            if (root is JValue rootValue)
            {
                return TryRemap(rootValue, map, out var replacement) ? JsonConvert.SerializeObject(replacement) : json;
            }

            foreach (var value in ((JContainer)root).Descendants().OfType<JValue>().ToList())
            {
                if (TryRemap(value, map, out var replacement))
                {
                    value.Value = replacement;
                    changed = true;
                }
            }

            // Writing the tree back could reformat numbers, so untouched JSON is returned as it came.
            return changed ? root.ToString(Formatting.None) : json;
        }

        private static bool TryRemap(JValue value, IReadOnlyDictionary<Guid, Guid> map, out string replacement)
        {
            replacement = string.Empty;

            if (value.Type != JTokenType.String || value.Value is not string text || !Guid.TryParse(text, out var old) || !map.TryGetValue(old, out var replacementId))
            {
                return false;
            }

            var format = GetFormat(text);
            replacement = replacementId.ToString(format);

            if (text.Any(char.IsUpper))
            {
                replacement = replacement.ToUpperInvariant();
            }

            return true;
        }

        private static string GetFormat(string text)
        {
            text = text.Trim();

            if (text.StartsWith('{'))
            {
                return "B";
            }

            if (text.StartsWith('('))
            {
                return "P";
            }

            return text.Contains('-') ? "D" : "N";
        }
    }
}
