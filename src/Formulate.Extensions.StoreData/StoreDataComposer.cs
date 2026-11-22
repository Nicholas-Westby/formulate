namespace Formulate.Extensions.StoreData
{
    using Formulate.Extensions.StoreData.Utilities;
    using Microsoft.Extensions.Configuration;
    using Microsoft.Extensions.DependencyInjection;
    using Umbraco.Cms.Core.Composing;
    using Umbraco.Cms.Core.DependencyInjection;

    public sealed class StoreDataComposer : IComposer
    {
        public void Compose(IUmbracoBuilder builder)
        {
            builder.Services.Configure<StoreDataSettings>(builder.Config.GetSection(StoreDataSettings.SectionName));
            builder.Services.AddSingleton<UploadFolders>();

            builder.Services.AddScoped<IStoreFields, StoreFields>();
            builder.Services.AddScoped<IStoreFiles, StoreFiles>();
            builder.Services.AddScoped<IStoreData, StoreData>();
        }
    }
}
