namespace Formulate.BackOffice.Api.Json
{
    using System;
    using System.Text.Json;
    using Formulate.Core.Utilities;
    using Microsoft.Extensions.Logging;

    /// <summary>
    /// Converts kind-specific configuration between how Formulate stores it (a JSON string) and how the
    /// Management API shows it (any JSON value).
    /// </summary>
    /// <remarks>
    /// The same mapping serves every entity with kind-specific configuration: form fields, form
    /// handlers, layouts, validations and data values.
    /// </remarks>
    public sealed class ConfigurationJson
    {
        private readonly IJsonUtility _jsonUtility;

        private readonly ILogger<ConfigurationJson> _logger;

        /// <inheritdoc cref="ConfigurationJson"/>
        public ConfigurationJson(IJsonUtility jsonUtility, ILogger<ConfigurationJson> logger)
        {
            _jsonUtility = jsonUtility;
            _logger = logger;
        }

        /// <summary>
        /// Gets the configuration to show, as the stored JSON.
        /// </summary>
        /// <param name="stored">The stored configuration.</param>
        /// <param name="entity">What the configuration belongs to, such as the form, for the warning.</param>
        /// <param name="item">The item within that entity, such as a field, for the warning.</param>
        /// <returns>
        /// The parsed JSON. Stored text that is not JSON comes back as a JSON string value, so reading
        /// never fails because of it, and a warning is logged. Nothing stored gives null.
        /// </returns>
        public JsonElement? FromStored(string? stored, string entity, string item)
        {
            if (string.IsNullOrWhiteSpace(stored))
            {
                return null;
            }

            try
            {
                using var document = JsonDocument.Parse(stored);

                return document.RootElement.Clone();
            }
            catch (JsonException)
            {
                _logger.LogWarning("The stored configuration of {Item} on {Entity} is not valid JSON, so it is returned as a string.", item, entity);

                return JsonSerializer.SerializeToElement(stored);
            }
        }

        /// <summary>
        /// Gets the configuration to show, as the kind's definition describes it for the back office.
        /// </summary>
        /// <param name="fromDefinition">Asks the definition for its back office configuration, or null when there is no definition.</param>
        /// <param name="stored">The stored configuration, used when there is no definition, when the definition gives nothing or when it fails.</param>
        /// <param name="entity">What the configuration belongs to, for warnings.</param>
        /// <param name="item">The item within that entity, for warnings.</param>
        public JsonElement? FromDefinition(Func<object?>? fromDefinition, string? stored, string entity, string item)
        {
            if (fromDefinition is not null)
            {
                try
                {
                    var configuration = fromDefinition();

                    if (configuration is not null)
                    {
                        using var document = JsonDocument.Parse(_jsonUtility.Serialize(configuration));

                        return document.RootElement.Clone();
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "The definition could not read the configuration of {Item} on {Entity}, so the stored configuration is returned.", item, entity);
                }
            }

            return FromStored(stored, entity, item);
        }

        /// <summary>
        /// Gets the text to store for a configuration sent to the API.
        /// </summary>
        /// <param name="configuration">The configuration; null (or JSON null) stores nothing.</param>
        public static string? ToStored(JsonElement? configuration)
        {
            if (configuration is null || configuration.Value.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
            {
                return null;
            }

            return configuration.Value.GetRawText();
        }
    }
}
