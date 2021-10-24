﻿using System;
using Formulate.Core.Types;

namespace Formulate.Core.Validations
{
    /// <summary>
    /// A contract for creating a validation.
    /// </summary>
    public interface IValidation : IFormulateType
    {
        /// <summary>
        /// Gets the ID.
        /// </summary>
        Guid Id { get; }
    }
}