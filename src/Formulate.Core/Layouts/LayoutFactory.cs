using System;
using Formulate.Core.Types;
using Microsoft.Extensions.Logging;

namespace Formulate.Core.Layouts
{
    /// <summary>
    /// The default implementation of <see cref="ILayoutFactory"/> using the <see cref="LayoutDefinitionCollection"/>.
    /// </summary>
    internal sealed class LayoutFactory : ILayoutFactory
    {
        /// <summary>
        /// The layout definitions.
        /// </summary>
        private readonly LayoutDefinitionCollection _layoutDefinitions;

        /// <summary>
        /// The logger.
        /// </summary>
        private readonly ILogger<LayoutFactory> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="LayoutFactory"/> class.
        /// </summary>
        /// <param name="layoutDefinitions">The layout definitions.</param>
        /// <param name="logger">The logger.</param>
        public LayoutFactory(LayoutDefinitionCollection layoutDefinitions, ILogger<LayoutFactory> logger)
        {
            _layoutDefinitions = layoutDefinitions;
            _logger = logger;
        }

        /// <inheritdoc />
        /// <remarks>
        /// Gives null when the kind is not installed, or when the kind can not read the configuration
        /// (such as a file that was edited by hand). The second is logged as a warning, so the page
        /// shows nothing where the form would be rather than failing.
        /// </remarks>
        /// <exception cref="ArgumentNullException">The provided settings are null.</exception>
        public ILayout Create(PersistedLayout entity)
        {
            if (entity is null)
            {
                throw new ArgumentNullException(nameof(entity));
            }

            var foundLayoutDefinition = _layoutDefinitions.FirstOrDefault(entity.KindId);

            if (foundLayoutDefinition is null)
            {
                return default;
            }

            try
            {
                return foundLayoutDefinition.CreateLayout(entity);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Skipping layout {LayoutName} ({LayoutId}) because its kind, {KindName} ({KindId}), could not read its configuration.",
                    entity.Name,
                    entity.Id,
                    foundLayoutDefinition.Name,
                    entity.KindId);

                return default;
            }
        }
    }
}