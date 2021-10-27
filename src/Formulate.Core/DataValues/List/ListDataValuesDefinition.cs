﻿using System;
using System.Collections.Generic;
using System.Linq;
using Formulate.Core.Utilities;

namespace Formulate.Core.DataValues.List
{
    /// <summary>
    /// A data values definition for providing a simple list of values.
    /// </summary>
    public sealed class ListDataValuesDefinition : DataValuesDefinition
    {
        /// <summary>
        /// The json utility.
        /// </summary>
        private readonly IJsonUtility _jsonUtility;

        /// <summary>
        /// Constants related to <see cref="ListDataValuesDefinition"/>.
        /// </summary>
        public static class Constants
        {
            /// <summary>
            /// The definition ID.
            /// </summary>
            public const string DefinitionId = "3106D817ABFC4D46A9B1ABA8B8F87F39";

            /// <summary>
            /// The definition label.
            /// </summary>
            public const string DefinitionLabel = "List";

            /// <summary>
            /// The Angular JS directive.
            /// </summary>
            public const string Directive = "formulate-data-values-list";

            /// <summary>
            /// The icon.
            /// </summary>
            public const string Icon = "icon-list";
        }

        /// <inheritdoc />
        public override Guid DefinitionId => Guid.Parse(Constants.DefinitionId);

        /// <inheritdoc />
        public override string DefinitionLabel => Constants.DefinitionLabel;

        /// <inheritdoc />
        public override string Directive => Constants.Directive;

        /// <inheritdoc />
        public override string Icon => Constants.Icon;

        /// <summary>
        /// Initializes a new instance of the <see cref="ListDataValuesDefinition"/> class.
        /// </summary>
        /// <param name="jsonUtility">The json utility.</param>
        public ListDataValuesDefinition(IJsonUtility jsonUtility)
        {
            _jsonUtility = jsonUtility;
        }

        /// <inheritdoc />
        protected override IDataValues CreateDataValues(IDataValuesSettings settings)
        {
            var items = new List<KeyValuePair<string, string>>();
            var preValues = _jsonUtility.Deserialize<ListDataValuesPreValues>(settings.Configuration);

            if (preValues is not null)
            {
                items.AddRange(preValues.Items.Select(x => new KeyValuePair<string, string>(x.Value, x.Value)).ToArray());
            }

            return new DataValues(settings, items);
        }
    }
}