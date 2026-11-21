namespace Formulate.Core.Utilities.Internal
{
    using System.Globalization;
    using System.IO;
    using Newtonsoft.Json;
    using Newtonsoft.Json.Serialization;

    /// <summary>
    /// An implementation of <see cref="IJsonSerializer"/> that uses Newtonsoft.Json.
    /// </summary>
    /// <remarks>
    /// It uses <see cref="JsonSerializer.Create(JsonSerializerSettings)"/>, not <see cref="JsonConvert"/>,
    /// because <see cref="JsonConvert"/> starts from <see cref="JsonConvert.DefaultSettings"/>. A host
    /// that sets those globally (for example <see cref="TypeNameHandling"/>, which lets the JSON choose
    /// the .NET type to create) must not change how Formulate reads form data.
    /// </remarks>
    internal sealed class NewtonsoftJsonSerializer : IJsonSerializer
    {
        private readonly JsonSerializerSettings _settings = new JsonSerializerSettings()
        {
            Formatting = Formatting.None,
            ContractResolver = new DefaultContractResolver(),
            TypeNameHandling = TypeNameHandling.None,
            // Text after the JSON makes a file invalid, as it did with JsonConvert.
            CheckAdditionalContent = true
        };

        /// <inheritdoc />
        public T Deserialize<T>(string value)
        {
            var serializer = JsonSerializer.Create(_settings);

            using var reader = new JsonTextReader(new StringReader(value));

            return serializer.Deserialize<T>(reader);
        }

        /// <inheritdoc />
        public string Serialize(object value)
        {
            var serializer = JsonSerializer.Create(_settings);
            var writer = new StringWriter(CultureInfo.InvariantCulture);

            using (var jsonWriter = new JsonTextWriter(writer) { Formatting = serializer.Formatting })
            {
                serializer.Serialize(jsonWriter, value);
            }

            return writer.ToString();
        }
    }
}
