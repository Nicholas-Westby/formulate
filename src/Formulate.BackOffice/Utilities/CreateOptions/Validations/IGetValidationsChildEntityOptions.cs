namespace Formulate.BackOffice.Utilities.CreateOptions.Validations
{
    using Formulate.BackOffice.Utilities.CreateOptions;
    using Formulate.Core.Persistence;
    using System.Collections.Generic;

    public interface IGetValidationsChildEntityOptions
    {
        IReadOnlyCollection<CreateChildEntityOption> Get(IPersistedEntity? parent);
    }
}
