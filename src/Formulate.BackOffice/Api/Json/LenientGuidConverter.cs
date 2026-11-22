namespace Formulate.BackOffice.Api.Json
{
    using System;
    using System.Text.Json;
    using System.Text.Json.Serialization;

    /// <summary>
    /// Reads GUIDs in any format (such as 32 digits with no dashes) and writes them in the "D" format.
    /// </summary>
    /// <remarks>
    /// System.Text.Json reads only the "D" format. Formulate's older IDs, kinds in particular, are written
    /// in the "N" format, so request models name this converter on their GUID properties.
    /// </remarks>
    public sealed class LenientGuidConverter : JsonConverterFactory
    {
        /// <inheritdoc />
        public override bool CanConvert(Type typeToConvert)
        {
            return typeToConvert == typeof(Guid) || typeToConvert == typeof(Guid?) || typeToConvert == typeof(Guid[]);
        }

        /// <inheritdoc />
        public override JsonConverter? CreateConverter(Type typeToConvert, JsonSerializerOptions options)
        {
            if (typeToConvert == typeof(Guid))
            {
                return new GuidConverter();
            }

            return typeToConvert == typeof(Guid?) ? new NullableGuidConverter() : new GuidArrayConverter();
        }

        private static Guid Read(ref Utf8JsonReader reader)
        {
            if (reader.TokenType == JsonTokenType.String && Guid.TryParse(reader.GetString(), out var value))
            {
                return value;
            }

            throw new JsonException("The value must be a GUID.");
        }

        private sealed class GuidConverter : JsonConverter<Guid>
        {
            public override Guid Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) => LenientGuidConverter.Read(ref reader);

            public override void Write(Utf8JsonWriter writer, Guid value, JsonSerializerOptions options) => writer.WriteStringValue(value.ToString("D"));
        }

        private sealed class NullableGuidConverter : JsonConverter<Guid?>
        {
            public override Guid? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
                reader.TokenType == JsonTokenType.Null ? null : LenientGuidConverter.Read(ref reader);

            public override void Write(Utf8JsonWriter writer, Guid? value, JsonSerializerOptions options)
            {
                if (value is null)
                {
                    writer.WriteNullValue();
                }
                else
                {
                    writer.WriteStringValue(value.Value.ToString("D"));
                }
            }
        }

        private sealed class GuidArrayConverter : JsonConverter<Guid[]>
        {
            public override Guid[]? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
            {
                if (reader.TokenType == JsonTokenType.Null)
                {
                    return null;
                }

                if (reader.TokenType != JsonTokenType.StartArray)
                {
                    throw new JsonException("The value must be an array of GUIDs.");
                }

                var values = new System.Collections.Generic.List<Guid>();

                while (reader.Read() && reader.TokenType != JsonTokenType.EndArray)
                {
                    values.Add(LenientGuidConverter.Read(ref reader));
                }

                return values.ToArray();
            }

            public override void Write(Utf8JsonWriter writer, Guid[] value, JsonSerializerOptions options)
            {
                writer.WriteStartArray();

                foreach (var guid in value)
                {
                    writer.WriteStringValue(guid.ToString("D"));
                }

                writer.WriteEndArray();
            }
        }
    }
}
