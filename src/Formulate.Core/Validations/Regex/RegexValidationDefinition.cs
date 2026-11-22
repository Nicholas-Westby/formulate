using Formulate.Core.Configuration;
using Formulate.Core.Utilities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;

namespace Formulate.Core.Validations.Regex
{
    /// <summary>
    /// The validation definition used to create <see cref="RegexValidation"/>.
    /// </summary>
    public sealed class RegexValidationDefinition : IValidationDefinition
    {
        /// <summary>
        /// The json utility.
        /// </summary>
        private readonly IJsonUtility _jsonUtility;

        /// <summary>
        /// Constants related to <see cref="RegexValidationDefinition"/>.
        /// </summary>
        public static class Constants
        {
            /// <summary>
            /// The kind ID.
            /// </summary>
            public const string KindId = "AC9A464F6F3F4AF9A3B29C85FF0C5580";

            /// <summary>
            /// The name.
            /// </summary>
            public const string Name = "Regular Expression";

            /// <summary>
            /// The back office editor alias.
            /// </summary>
            public const string EditorAlias = "formulate-regex-validation";
        }

        private readonly IOptions<FormulateSubmissionsOptions> _options;

        private readonly ILogger<RegexValidation> _logger;

        public RegexValidationDefinition(IJsonUtility jsonUtility, IOptions<FormulateSubmissionsOptions> options, ILogger<RegexValidation> logger)
        {
            _jsonUtility = jsonUtility;
            _options = options;
            _logger = logger;
        }

        /// <inheritdoc />
        public Guid KindId => Guid.Parse(Constants.KindId);

        /// <inheritdoc />
        public string Name => Constants.Name;

        /// <inheritdoc />
        public string EditorAlias => Constants.EditorAlias;
        
        /// <inheritdoc />
        public bool IsLegacy => false;

        /// <inheritdoc />
        public Validation CreateValidation(PersistedValidation entity)
        {
            var config = _jsonUtility.Deserialize<RegexValidationConfiguration>(entity.Data) ?? new RegexValidationConfiguration();

            return new RegexValidation(entity, config, _options.Value.EnableServerSideValidation, _logger);
        }

        /// <inheritdoc />
        public object GetBackOfficeConfiguration(PersistedValidation entity)
        {
            var config = _jsonUtility.Deserialize<RegexValidationConfiguration>(entity.Data);

            if (config is null)
            {
                return new RegexValidationConfiguration();
            }

            return config;
        }
    }
}