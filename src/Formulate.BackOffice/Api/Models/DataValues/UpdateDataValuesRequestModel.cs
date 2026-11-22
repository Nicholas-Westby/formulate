namespace Formulate.BackOffice.Api.Models.DataValues
{
    using System.Text.Json;

    /// <summary>
    /// Replaces the name, alias and configuration of a data values item.
    /// </summary>
    public sealed class UpdateDataValuesRequestModel
    {
        /// <summary>
        /// Gets the name.
        /// </summary>
        public string Name { get; init; } = string.Empty;

        /// <summary>
        /// Gets the alias.
        /// </summary>
        public string? Alias { get; init; }

        /// <summary>
        /// Gets the kind-specific configuration, which can be any JSON value.
        /// </summary>
        public JsonElement? Configuration { get; init; }
    }
}
