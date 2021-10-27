﻿using System;
using Formulate.Core.Utilities;

namespace Formulate.Core.Layouts.Basic
{
    /// <summary>
    /// A layout definition for creating <see cref="BasicLayout"/>.
    /// </summary>
    public sealed class BasicLayoutDefinition : ILayoutDefinition
    {
        private readonly IJsonUtility _jsonUtility;

        /// <summary>
        /// Constants related to <see cref="BasicLayoutDefinition"/>.
        /// </summary>
        public static class Constants
        {
            /// <summary>
            /// The definition ID.
            /// </summary>
            public const string DefinitionId = "B03310E9320744DCBE96BE0CF4F26C59";

            /// <summary>
            /// The definition label.
            /// </summary>
            public const string DefinitionLabel = "Basic Layout";

            /// <summary>
            /// The Angular JS directive.
            /// </summary>
            public const string Directive = "formulate-layout-basic";
        }

        /// <inheritdoc />
        public Guid DefinitionId => Guid.Parse(Constants.DefinitionId);

        /// <inheritdoc />
        public string DefinitionLabel => Constants.DefinitionLabel;

        /// <inheritdoc />
        public string Directive => Constants.Directive;
        
        /// <summary>
        /// 
        /// </summary>
        /// <param name="jsonUtility"></param>
        public BasicLayoutDefinition(IJsonUtility jsonUtility)
        {
            _jsonUtility = jsonUtility;
        }

        /// <inheritdoc />
        public ILayout CreateLayout(ILayoutSettings settings)
        {
            var config = _jsonUtility.Deserialize<BasicLayoutConfiguration>(settings.Configuration);

            return new BasicLayout(settings, config);
        }
    }
}