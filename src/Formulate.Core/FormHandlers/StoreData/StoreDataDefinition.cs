﻿namespace Formulate.Core.FormHandlers.StoreData
{
    // Namespaces.
    using System;

    /// <summary>
    /// The data definition for a form handler that stores data to the database.
    /// </summary>
    public sealed class StoreDataDefinition : FormHandlerDefinition
    {
        /// <summary>
        /// Constants related to <see cref="StoreDataDefinition"/>.
        /// </summary>
        public static class Constants
        {
            /// <summary>
            /// The kind ID.
            /// </summary>
            public const string KindId = "238EA92071F44D8C9CC433D7181C9C46";

            /// <summary>
            /// The definition label.
            /// </summary>
            public const string DefinitionLabel = "Store Data";

            /// <summary>
            /// The icon.
            /// </summary>
            public const string Icon = "icon-formulate-store-data";

            /// <summary>
            /// The Angular JS directive.
            /// </summary>
            public const string Directive = "formulate-store-data-handler";
        }

        /// <inheritdoc />
        public override string Directive => Constants.Directive;

        /// <inheritdoc />
        public override string DefinitionLabel => Constants.DefinitionLabel;

        /// <inheritdoc />
        public override Guid KindId => Guid.Parse(Constants.KindId);

        /// <inheritdoc />
        public override FormHandler CreateHandler(IFormHandlerSettings settings)
        {
            var handler = new StoreDataHandler(settings);
            handler.Icon = Constants.Icon;
            return handler;
        }
    }
}