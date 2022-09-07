﻿namespace Formulate.Website.DependencyInjection
{
    using Formulate.Website.Utilities;
    using Microsoft.Extensions.DependencyInjection;
    using Umbraco.Cms.Core.DependencyInjection;

    public static class UmbracoBuilderExtensions
    {
        public static IUmbracoBuilder AddFormulateWebsite(this IUmbracoBuilder umbracoBuilder)
        {
            umbracoBuilder.Services.AddSingleton<IBuildFormLayoutRenderModel, BuildFormLayoutRenderModel>();
            umbracoBuilder.Services.AddScoped<IAttemptSubmitForm, AttemptSubmitForm>();

            return umbracoBuilder;
        }
    }
}
