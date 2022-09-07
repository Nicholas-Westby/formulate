﻿using System;
using Formulate.Core.Types;

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
        /// Initializes a new instance of the <see cref="LayoutFactory"/> class.
        /// </summary>
        /// <param name="layoutDefinitions">The layout definitions.</param>
        public LayoutFactory(LayoutDefinitionCollection layoutDefinitions)
        {
            _layoutDefinitions = layoutDefinitions;
        }

        /// <inheritdoc />
        /// <exception cref="ArgumentNullException">The provided settings are null.</exception>
        public ILayout Create(PersistedLayout entity)
        {
            if (entity is null)
            {
                throw new ArgumentNullException(nameof(entity));
            }

            var foundLayoutDefinition = _layoutDefinitions.FirstOrDefault(entity.KindId);

            return foundLayoutDefinition?.CreateLayout(entity);
        }
    }
}