﻿namespace Formulate.Core.Templates
{
    using Umbraco.Cms.Core.Composing;

    /// <inheritdoc />
    public sealed class TemplateDefinitionCollectionBuilder : LazyCollectionBuilderBase<TemplateDefinitionCollectionBuilder, TemplateDefinitionCollection, ITemplateDefinition>
    {
        /// <inheritdoc />
        protected override TemplateDefinitionCollectionBuilder This => this;
    }
}