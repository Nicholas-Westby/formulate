﻿using System;
using Formulate.Core.Persistence;

namespace Formulate.Core.Validations
{
    public sealed class PersistedValidation : IPersistedEntity, IValidationSettings
    {
        /// <summary>
        /// Gets or sets the ID.
        /// </summary>
        public Guid Id { get; set; }

        /// <summary>
        /// Gets or sets the definition ID.
        /// </summary>
        public Guid DefinitionId { get; set; }
        
        /// <summary>
        /// Gets or sets the path.
        /// </summary>
        public Guid[] Path { get; set; }

        /// <summary>
        /// Gets or sets the name.
        /// </summary>
        public string Name { get; set; }

        /// <summary>
        /// Gets or sets the configuration.
        /// </summary>
        public string Configuration { get; set; }
    }
}