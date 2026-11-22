namespace Formulate.Core.FormFields.ExtendedRadioButtonList
{
    using System;
    using System.Runtime.Serialization;
    using Newtonsoft.Json;
    using Newtonsoft.Json.Linq;

    /// <summary>
    /// Configuration pre-values used by <see cref="ExtendedRadioButtonListFieldDefinition"/>
    /// for creating <see cref="ExtendedRadioButtonListField"/>. Formulate 3 stored only the data value.
    /// </summary>
    [DataContract]
    internal sealed class ExtendedRadioButtonListFieldPreValues
    {
        /// <summary>
        /// Gets or sets the data value, which is empty when none is stored, or the stored text is not a GUID.
        /// </summary>
        [DataMember(Name = "dataValue")]
        [JsonConverter(typeof(TolerantGuidConverter))]
        public Guid DataValue { get; set; }

        /// <summary>
        /// Gets or sets the orientation.
        /// </summary>
        [DataMember(Name = "orientation")]
        public string Orientation { get; set; }

        /// <summary>
        /// Reads a GUID written with or without dashes, and gives an empty GUID for anything else (a blank
        /// or null value, text that is not a GUID, a number), so a stored value never makes a field unreadable.
        /// </summary>
        private sealed class TolerantGuidConverter : JsonConverter
        {
            public override bool CanConvert(Type objectType) => objectType == typeof(Guid);

            public override object ReadJson(JsonReader reader, Type objectType, object existingValue, JsonSerializer serializer)
            {
                var token = JToken.Load(reader);

                return token.Type == JTokenType.String && Guid.TryParse(token.Value<string>(), out var id) ? id : Guid.Empty;
            }

            public override void WriteJson(JsonWriter writer, object value, JsonSerializer serializer)
            {
                writer.WriteValue(((Guid)value).ToString("D"));
            }
        }
    }
}
